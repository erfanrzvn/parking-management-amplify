// Isolated browser layout checks: real React pages with in-memory auth/data.
// Never creates AWS accounts or records. Set PLAYWRIGHT_MODULE to a local installation.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = 'build/responsive';
fs.mkdirSync(out, { recursive: true });
const fixtures = `
const now = Date.now();
const resident = {id:'resident-1',userId:'user-1',name:'Alexandra Long Resident Name',email:'alexandra.long.resident@example.com',phone:'+14165550123',building:'North residential building',floor:'12',unitNumber:'1204',plate:'ABC-1234',householdId:'ABC123'};
const parking = {id:'parking-1',name:'North residential visitor parking',totalSpots:9,createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
const reservation = {id:'reservation-1',residentId:resident.id,householdId:resident.householdId,guestPlate:'GUEST-123',guestEmail:'long.guest.email@example.com',guestMobile:'+14165550456',startTime:new Date(now-60000).toISOString(),endTime:new Date(now+7200000).toISOString(),createdAt:new Date(now).toISOString(),status:'ACTIVE'};
export const listParkingConfigs = async()=>[parking];
export const listResidents = async()=>[resident, {...resident,id:'resident-2',name:'Second household member'}];
export const listReservations = async()=>[reservation];
export const getResidentByUserId = async()=>resident;
export const createReservation = async()=>reservation;
export const createParkingConfig = async()=>parking;
export const deleteParkingConfig = async()=>parking;
export const updateResident = async()=>resident;
export const deleteResident = async()=>resident;
export const cancelReservation = async()=>reservation;
`;
const auth = `
const role = new URLSearchParams(location.search).get('role');
export const fetchAuthSession=async()=> role ? {tokens:{accessToken:{payload:{'cognito:groups':[role]}}}} : {};
export const fetchUserAttributes=async()=>({email:'alexandra.long.resident@example.com',sub:'user-1'});
export const signOut=async()=>{};
export const signIn=async()=>({nextStep:{signInStep:'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'}});
export const confirmSignIn=async()=>({isSignedIn:true});
`;
const server = await createServer({
  server: { host:'127.0.0.1',port:5174,strictPort:true },
  plugins:[{name:'isolated-layout-fixtures',enforce:'pre',
    resolveId(id){
      if(id.endsWith('/lib/graphql')) return '\0layout-data';
      if(id==='aws-amplify/auth') return '\0layout-auth';
      if(id==='aws-amplify/api') return '\0layout-api';
    },
    load(id){
      if(id==='\0layout-data') return fixtures;
      if(id==='\0layout-auth') return auth;
      if(id==='\0layout-api') return 'export const generateClient=()=>({graphql:async()=>({data:{}})});';
    }
  }]
});
await server.listen();
const browser = await chromium.launch({channel:'msedge',headless:true});
const results=[];
try {
  for (const width of [320,375,390,430,768,1024,1440]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.route('**/*.amazonaws.com/**', route=>route.abort());
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    async function check(name){
      await page.evaluate(()=>document.fonts.ready);
      const layout=await page.evaluate(()=>{
        const w=document.documentElement.clientWidth;
        const overflow=[...document.querySelectorAll('input,select,button,.form-section,.stat-card,.info-card,.modal-content,.time-picker-container,.reservations-table')].filter(e=>{
          const b=e.getBoundingClientRect();
          return b.width && !e.closest('.reservations-table-container,.residents-table-container,.logs-table-container') && (b.right>w+1 || b.left< -1);
        }).map(e=>({tag:e.tagName,class:e.className,id:e.id}));
        return {width:w,scrollWidth:document.documentElement.scrollWidth,overflow};
      });
      await page.screenshot({path:`${out}/${width}-${name}.png`,fullPage:true,animations:'disabled'});
      results.push({width,name,...layout});
      assert.ok(layout.scrollWidth<=width+1,`${width} ${name}: document overflow ${layout.scrollWidth}`);
      assert.deepEqual(layout.overflow,[],`${width} ${name}: clipped controls`);
      if(width<=768 && await page.locator('.form-row').count()){
        const columns=await page.locator('.form-row').first().evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
        assert.equal(columns,1,`${name}: mobile form columns`);
      }
      assert.deepEqual(errors,[],`${name}: page errors`);
    }
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('Resident Code').waitFor();
    await check('guest');
    await page.getByLabel('Resident Code').fill('AB');
    await page.getByText('Code must be exactly 6 characters').waitFor();
    await check('guest-validation');
    await page.getByLabel('Resident Code').fill('ABC123');
    await page.getByLabel('Unit Number').fill('1204');
    await page.getByLabel('License Plate').fill('GUEST-123');
    await page.getByLabel('Mobile Number').fill('+14165550456');
    await page.locator('#guestEmail').fill('guest@example.com');
    await page.getByRole('button',{name:'Reserve Parking Spot'}).click();
    await page.getByText('Reservation Confirmed!').waitFor();
    await check('guest-success');
    await page.goto('http://127.0.0.1:5174');
    await page.getByRole('button',{name:'Staff Login'}).click();
    await page.getByLabel('Email Address').waitFor();
    await check('login');
    await page.getByLabel('Email Address').fill('resident@example.com');
    await page.getByLabel('Password',{exact:true}).fill('Temporary1!');
    await page.getByRole('button',{name:'Sign In'}).click();
    await page.getByLabel('Choose a new password').waitFor();
    await check('new-password');
    await page.goto('http://127.0.0.1:5174/?role=ADMIN');
    await page.locator('.reservations-table tbody tr').first().waitFor();
    await check('admin-reservations');
    await page.getByTitle('View details').first().click();
    await check('reservation-details');
    await page.locator('.modal-close').click();
    await page.getByTitle('Add more time').click();
    await check('extend-reservation');
    await page.locator('.modal-close').click();
    await page.getByRole('button',{name:'New Parking'}).click();
    await page.locator('.modal-content').waitFor();
    await check('parking-modal');
    await page.locator('.modal-close').click();
    for(const [tab,name] of [['All Logs','admin-logs'],['Residents (','admin-residents'],['Parkings (','admin-parkings']]){
      await page.getByRole('button',{name:tab,exact:false}).click();
      await check(name);
      if(name==='admin-residents'){
        await page.getByRole('button',{name:'Add Resident'}).click();
        await page.locator('.modal-content').waitFor();
        await check('resident-modal');
        await page.locator('.modal-actions .btn-submit').scrollIntoViewIfNeeded();
        const reachable=await page.locator('.modal-actions .btn-submit').evaluate(e=>{
          const b=e.getBoundingClientRect(); return b.top>=0 && b.bottom<=innerHeight;
        });
        assert.ok(reachable, 'Modal submit must be reachable by scrolling');
        await page.locator('.modal-close').click();
      }
    }
    await page.goto('http://127.0.0.1:5174/?role=RESIDENT');
    await page.locator('.code-text').waitFor();
    await check('resident');
    await page.close();
    console.log(`PASS ${width}px`);
  }
} finally {
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(results,null,2));
  await browser.close(); await server.close();
}
console.log(`PASS ${results.length} responsive page/viewport checks`);


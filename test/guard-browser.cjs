// Production UI smoke test. Only creates disposable Cognito accounts; finally
// removes the exact tracked accounts. No resident/booking data is modified.
const {createRequire}=require('node:module');
const path=require('node:path');const fs=require('node:fs');const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const local=createRequire(path.resolve('lambda/api.js'));
const sdk=local('@aws-sdk/client-cognito-identity-provider');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const pool='ca-central-1_dBeo5yZXq';const client=new sdk.CognitoIdentityProviderClient({region:'ca-central-1'});
const url='https://master.d1b6dmf1w1balm.amplifyapp.com/';
const suffix=Date.now()+randomBytes(4).toString('hex');
const admin=`codex-parking-ui-admin-${suffix}@example.com`,guard=`codex-parking-ui-guard-${suffix}@example.com`;
const password=`Aa1!${randomBytes(18).toString('base64url')}`;
const tracked=[];const passed=[];let browser,failure;const cleanupErrors=[];
async function trackUnused(email){
 try{await client.send(new sdk.AdminGetUserCommand({UserPoolId:pool,Username:email}));throw new Error('Fixture account already exists');}catch(e){if(e.name!=='UserNotFoundException')throw e;}
 tracked.push(email);fs.writeFileSync('build/guard-browser-fixtures.json',JSON.stringify(tracked));
}
async function login(page,email){
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Staff Login'}).click();
 await page.getByLabel('Email Address').fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign In'}).click();
 await page.getByLabel('Choose a new password').waitFor();
 await page.getByLabel('Choose a new password').fill(`Aa1!${randomBytes(18).toString('base64url')}`);
 await page.getByRole('button',{name:'Set Password and Sign In'}).click();
}
(async()=>{
try{
 if(!process.argv.includes('--write-fixtures'))throw new Error('--write-fixtures required');
 await trackUnused(admin);
 await client.send(new sdk.AdminCreateUserCommand({UserPoolId:pool,Username:admin,TemporaryPassword:password,MessageAction:'SUPPRESS',UserAttributes:[{Name:'email',Value:admin}]}));
 await client.send(new sdk.AdminAddUserToGroupCommand({UserPoolId:pool,Username:admin,GroupName:'ADMIN'}));
 browser=await chromium.launch({channel:'msedge',headless:true});
 const adminContext=await browser.newContext({viewport:{width:1280,height:900}});
 const adminPage=await adminContext.newPage();adminPage.setDefaultTimeout(30000);
 await login(adminPage,admin);
 await adminPage.getByRole('button',{name:'Guard Accounts',exact:true}).click();
 await trackUnused(guard);
 await adminPage.getByLabel('Name',{exact:true}).fill('Disposable UI guard');
 await adminPage.getByLabel('Username (email)').fill(guard);
 await adminPage.getByLabel('Temporary password').fill(password);
 await adminPage.getByRole('button',{name:'Create guard',exact:true}).click();
 await adminPage.getByRole('status').filter({hasText:'Guard account created for'}).waitFor();
 const accountCard=adminPage.locator('.guard-accounts article').filter({hasText:guard});
 await accountCard.getByRole('button',{name:'Disable access'}).waitFor();
 passed.push('Admin creates guard in live panel');console.log('PASS admin creates guard');
 const guardContext=await browser.newContext({viewport:{width:390,height:844}});
 const guardPage=await guardContext.newPage();guardPage.setDefaultTimeout(30000);
 await login(guardPage,guard);
 await guardPage.getByRole('heading',{name:'Guard Dashboard'}).waitFor();
 await guardPage.getByRole('button',{name:'Refresh',exact:true}).waitFor();
 await guardPage.waitForFunction(()=>!document.querySelector('.btn-refresh')?.disabled);
 assert.deepEqual((await guardPage.getByRole('button').allTextContents()).map(x=>x.trim()).sort(),['Refresh','Sign Out']);
 assert.equal(await guardPage.getByRole('button',{name:'Guard Accounts',exact:true}).count(),0);
 const width=await guardPage.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 assert.ok(width.document<=width.viewport+1);
 await guardPage.screenshot({path:'build/responsive/live-guard.png',fullPage:true});
 passed.push('Guard first login changes password in Cognito and opens read-only mobile dashboard');console.log('PASS guard first login and read-only dashboard');
 adminPage.once('dialog',d=>d.accept());
 await accountCard.getByRole('button',{name:'Disable access'}).click();
 await accountCard.getByRole('button',{name:'Enable access'}).waitFor();
 await guardPage.getByRole('button',{name:'Refresh',exact:true}).click();
 await guardPage.getByRole('alert').filter({hasText:'Unable to load active bookings'}).waitFor();
 passed.push('Admin disables account and existing guard session loses API access');console.log('PASS live access revocation');
} catch(e){failure=e.message;console.error('FAIL',failure)}
finally{
 if(browser)await browser.close();
 for(const Username of tracked){try{await client.send(new sdk.AdminDeleteUserCommand({UserPoolId:pool,Username}));}catch(e){if(e.name!=='UserNotFoundException')cleanupErrors.push(e.name);}}
 fs.writeFileSync('build/guard-browser-report.json',JSON.stringify({time:new Date().toISOString(),passed,failure,cleanupErrors},null,2));
 if(failure||cleanupErrors.length)process.exitCode=1;
}
})();

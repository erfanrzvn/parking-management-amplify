import { util } from '@aws-appsync/utils';
export function request() {
  util.error('A short maintenance update is in progress. Please try again shortly.', 'Maintenance');
  return null;
}
export function response(ctx) { return ctx.result; }

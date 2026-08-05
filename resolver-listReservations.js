import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const limit = ctx.args.limit || 50;
  const nextToken = ctx.args.nextToken || null;
  
  return { 
    operation: 'Scan',
    limit: limit,
    nextToken: nextToken
  };
}

export function response(ctx) {
  return {
    items: ctx.result.items,
    nextToken: ctx.result.nextToken
  };
}

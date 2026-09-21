import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { reservationId } = ctx.arguments;
  const now = util.time.nowISO8601();

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ id: reservationId }),
    update: {
      expression: 'SET #status = :status, #deletedAt = :deletedAt, #updatedAt = :updatedAt',
      expressionNames: {
        '#status': 'status',
        '#deletedAt': 'deletedAt',
        '#updatedAt': 'updatedAt',
      },
      expressionValues: util.dynamodb.toMapValues({
        ':status': 'CANCELLED',
        ':deletedAt': now,
        ':updatedAt': now,
      }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}

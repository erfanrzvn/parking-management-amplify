export function request(ctx) {
  const { id } = ctx.args;
  return {
    operation: 'UpdateItem',
    key: {
      id: { S: id }
    },
    update: {
      expression: 'SET #status = :status, #deletedAt = :deletedAt, #updatedAt = :updatedAt',
      expressionNames: {
        '#status': 'status',
        '#deletedAt': 'deletedAt',
        '#updatedAt': 'updatedAt'
      },
      expressionValues: {
        ':status': { S: 'CANCELLED' },
        ':deletedAt': { S: util.time.nowISO8601() },
        ':updatedAt': { S: util.time.nowISO8601() }
      }
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}

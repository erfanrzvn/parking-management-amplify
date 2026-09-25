// All reservation writes use the same transactional booking path.
exports.handler = event => require('./api').handler({ ...event, info: { ...event.info, fieldName: 'createReservation' } });

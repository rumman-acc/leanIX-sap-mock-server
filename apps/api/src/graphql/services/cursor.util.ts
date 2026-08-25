export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf-8').toString('base64');
}

export function decodeCursor(cursor: string): string {
  const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as { id: string };
  return decoded.id;
}

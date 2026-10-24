export function ownerStatus(user) {
  if (!user) return 401;
  if (!Array.isArray(user.roles) || !user.roles.includes("owner")) return 403;
  return 200;
}

export function noStoreJson(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function isSuperAdmin(user) {
  return user?.role === 'superadmin';
}

function requireDepot(req, res) {
  if (isSuperAdmin(req.user)) {
    const depotId = req?.body?.depotId || req?.query?.depotId || req?.params?.depotId;
    // Treat '0' and the string representations of null/undefined/empty as missing (require explicit depot)
    if (!depotId || depotId === '0' || depotId === 'all' || depotId === 'null' || depotId === 'undefined' || depotId === '') {
      res.status(400).json({ success: false, message: 'Depot is required.' });
      return null;
    }
    return depotId;
  }

  if (!req.user?.depotId) {
    res.status(403).json({ success: false, message: 'Your account is not assigned to a depot.' });
    return null;
  }

  return req.user.depotId;
}

function selectedDepot(req) {
  if (isSuperAdmin(req.user)) {
    const depotId = req?.query?.depotId || req?.body?.depotId || req?.params?.depotId || null;
    // Treat '0' (frontend All Depots) and string null/undefined/empty as no selection (show all)
    if (depotId === '0' || depotId === 'all' || depotId === 'null' || depotId === 'undefined' || depotId === '') {
      return null;
    }
    return depotId;
  }
  return req.user?.depotId || null;
}

function depotWhere(req, alias = '') {
  const depotId = selectedDepot(req);
  if (!depotId) return { clause: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { clause: ` AND ${prefix}depotId = ?`, params: [depotId] };
}

function depotWhereStart(req, alias = '') {
  const depotId = selectedDepot(req);
  if (!depotId) return { clause: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return { clause: ` WHERE ${prefix}depotId = ?`, params: [depotId] };
}

function sameDepotOrSuperAdmin(req, depotId) {
  return isSuperAdmin(req.user) || Number(req.user?.depotId) === Number(depotId);
}

module.exports = {
  isSuperAdmin,
  requireDepot,
  selectedDepot,
  depotWhere,
  depotWhereStart,
  sameDepotOrSuperAdmin
};

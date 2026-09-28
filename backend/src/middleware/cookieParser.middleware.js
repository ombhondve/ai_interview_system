export default function cookieParser(req, res, next) {
  const header = req.headers.cookie || "";
  req.cookies = {};

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const name = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1);
    req.cookies[name] = decodeURIComponent(value);
  }

  next();
}

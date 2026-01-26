export default async function handler(req, res) {
  // เปิดใน browser ได้เลย แล้วมันจะยิง POST ให้เอง
  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Test setPin</title>
    <style>
      body{font-family:Arial;padding:24px;max-width:520px}
      input{padding:10px;font-size:16px;width:100%;margin:8px 0}
      button{padding:10px 14px;font-size:16px;cursor:pointer}
      pre{background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap}
    </style>
  </head>
  <body>
    <h2>Test setPin</h2>
    <label>volunteer_code</label>
    <input id="code" placeholder="เช่น 80010301" />
    <label>PIN 4 หลัก</label>
    <input id="pin" placeholder="เช่น 1234" />
    <button id="btn">ส่ง setPin (POST)</button>
    <pre id="out">...</pre>

    <script>
      const out = document.getElementById('out');
      document.getElementById('btn').onclick = async () => {
        out.textContent = 'กำลังส่ง...';
        const volunteer_code = document.getElementById('code').value.trim();
        const pin = document.getElementById('pin').value.trim();

        try {
          const r = await fetch('/api/auth/setPin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ volunteer_code, pin })
          });
          const data = await r.json().catch(() => ({}));
          out.textContent = 'HTTP ' + r.status + '\\n' + JSON.stringify(data, null, 2);
        } catch (e) {
          out.textContent = 'ERROR: ' + (e?.message || e);
        }
      };
    </script>
  </body>
</html>
  `;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
}

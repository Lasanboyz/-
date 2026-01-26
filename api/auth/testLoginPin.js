export default async function handler(req, res) {
  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Test loginPin</title>
    <style>
      body{font-family:Arial;padding:24px;max-width:640px}
      input{padding:10px;font-size:16px;width:100%;margin:8px 0}
      button{padding:10px 14px;font-size:16px;cursor:pointer}
      pre{background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-word}
      .row{display:flex;gap:12px}
      .row > div{flex:1}
    </style>
  </head>
  <body>
    <h2>Test loginPin</h2>

    <div class="row">
      <div>
        <label>volunteer_code</label>
        <input id="code" placeholder="เช่น 80010301" />
      </div>
      <div>
        <label>PIN 4 หลัก</label>
        <input id="pin" placeholder="เช่น 4284" />
      </div>
    </div>

    <button id="btn">ส่ง loginPin (POST)</button>
    <button id="copy" style="margin-left:8px">Copy token</button>

    <pre id="out">...</pre>

    <script>
      const out = document.getElementById('out');
      let lastToken = '';

      document.getElementById('btn').onclick = async () => {
        out.textContent = 'กำลังส่ง...';
        const volunteer_code = document.getElementById('code').value.trim();
        const pin = document.getElementById('pin').value.trim();

        try {
          const r = await fetch('/api/auth/loginPin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ volunteer_code, pin })
          });

          const data = await r.json().catch(() => ({}));
          lastToken = data?.token || '';

          out.textContent =
            'HTTP ' + r.status + '\\n' +
            JSON.stringify({
              ok: data.ok,
              token: lastToken ? (lastToken.slice(0, 25) + '...') : null,
              volunteer: data.volunteer || null,
              error: data.error || null
            }, null, 2);
        } catch (e) {
          out.textContent = 'ERROR: ' + (e?.message || e);
        }
      };

      document.getElementById('copy').onclick = async () => {
        if (!lastToken) return alert('ยังไม่มี token ให้ copy (กด login ก่อน)');
        await navigator.clipboard.writeText(lastToken);
        alert('copy token แล้ว');
      };
    </script>
  </body>
</html>
  `;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
}

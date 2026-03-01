const { Client } = require("pg");
const client = new Client("postgresql://aris:aris_dev_2024@127.0.0.1:5432/aris");
client.connect()
  .then(() => client.query("SELECT current_user, inet_client_addr()"))
  .then(res => { console.log("OK!", res.rows[0]); client.end(); })
  .catch(err => console.error("Failed:", err.message));

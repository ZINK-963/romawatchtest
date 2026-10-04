const app = require("./src/app");
const { port } = require("./src/config");

app.listen(port, () => {
  console.log(`روما واچ بک‌اند روی پورت ${port} در حال اجراست`);
  console.log(`http://localhost:${port}`);
});

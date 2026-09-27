import { app } from "./app";

const port = 3001;

app.listen(
  port,
  "127.0.0.1",
  () => {
    console.log(
      `FinSight server running at http://127.0.0.1:${port}`,
    );
  },
);

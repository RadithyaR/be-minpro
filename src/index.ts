
import App from "./app";
import dotenv from "dotenv";

dotenv.config(); // load env variables

const main = () => {
  const app = new App();

 
  app.start();
};

main();

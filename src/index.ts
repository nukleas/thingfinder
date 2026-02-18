import { createProgram } from './cli.js';

const program = createProgram();
program.parseAsync(process.argv).catch((error) => {
  console.error(error.message);
  process.exit(1);
});

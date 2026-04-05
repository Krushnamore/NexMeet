const cluster = require('cluster');
const os = require('os');
const logger = require('./utils/logger');

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  logger.info(`Master process ${process.pid} is running`);
  logger.info(`Forking ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  require('./server');
  logger.info(`Worker ${process.pid} started`);
}

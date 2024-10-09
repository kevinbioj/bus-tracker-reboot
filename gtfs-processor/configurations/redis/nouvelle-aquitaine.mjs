/** @type {import('redis').RedisClientOptions} */
const redisOptions = {
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
};

export default redisOptions;

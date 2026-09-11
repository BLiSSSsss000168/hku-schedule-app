const os = require("node:os");

const originalUserInfo = os.userInfo;
os.userInfo = (options) => {
  try {
    return originalUserInfo(options);
  } catch {
    return {
      username: process.env.USERNAME || "user",
      uid: -1,
      gid: -1,
      shell: null,
      homedir: os.homedir(),
    };
  }
};

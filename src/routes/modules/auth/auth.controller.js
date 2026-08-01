import { EnvConfig } from "#src/config/env.config.js";
import { GetUserByEmailService } from "#src/routes/modules/auth/auth.service.js";

// ? This is the controller for the signup route
export const AuthSignUpController = async (req, res) => {
  const email = req.body.email;
  const name = req.body.name;
  const password = req.body.password;

  const findUser = await GetUserByEmailService(email);

  if (findUser) {
    return res.status(400).json({ message: ERROR_MESSAGES.USER_ALREADY_EXISTS });
  }

  const passwordHash = await bcrypt.hash(password, EnvConfig.BCRYPT_SALT_ROUNDS);

  await CreateUserService({ name, email, passwordHash });

  return res.status(201).json({ message: SUCCESS_MESSAGES.USER_REGISTERED_SUCCESSFULLY });
};

// ? This is the Controller for the login route
export const AuthLoginController = async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const findUser = await GetUserByEmailService(email);

  if (!findUser) {
    return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  const comparePassword = await bcrypt.compare(password, findUser.password);

  if (!comparePassword) {
    return res.status(400).json({ message: INVALID_CREDENTIALS });
  }

  return res.status(200).json({ message: SUCCESS_MESSAGES.USER_LOGGED_IN_SUCCESSFULLY });
};

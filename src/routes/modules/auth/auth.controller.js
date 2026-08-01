import { EnvConfig } from "#src/config/env.config.js";
import { CreateUserService, GetUserByEmailService } from "#src/routes/modules/auth/auth.service.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// ? This is the controller for the signup route
export const AuthSignUpController = async (req, res) => {
  const email = req.body.email;
  const name = req.body.name;
  const password = req.body.password;

  const findUser = await GetUserByEmailService(email);

  if (findUser) {
    return res.status(400).json({ message: ERROR_MESSAGES.USER_ALREADY_EXISTS });
  }

  const passwordHash = bcrypt.hashSync(password, EnvConfig.HASH_PASSWORD_SALT);

  const user = await CreateUserService({ name, email, passwordHash });

  const jwt_token = jwt.sign({ id: user.id, email: user.email }, EnvConfig.JWT_SECRET, {
    expiresIn: EnvConfig.JWT_EXPIRES_IN,
  });

  return res
    .status(201)
    .json({ message: SUCCESS_MESSAGES.USER_REGISTERED_SUCCESSFULLY, Success: true, token: jwt_token });
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
    return res.status(400).json({ message: ERROR_MESSAGES.INVALID_CREDENTIALS });
  }

  const jwt_token = jwt.sign({ id: findUser.id, email: findUser.email }, EnvConfig.JWT_SECRET, {
    expiresIn: EnvConfig.JWT_EXPIRES_IN,
  });

  return res
    .status(200)
    .json({ message: SUCCESS_MESSAGES.USER_LOGGED_IN_SUCCESSFULLY, Success: true, token: jwt_token });
};

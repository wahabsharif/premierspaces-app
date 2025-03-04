export interface LoginPayload {
  initials: string;
  pin: string;
}

export interface LoginRequest {
  userid: number;
  payload: LoginPayload;
}

export interface LoginSuccessResponse {
  status: number;
  payload: {
    userid: number;
    name: string;
    role: string;
  };
}

export interface LoginErrorResponse {
  status: number;
  payload: {
    message: string;
  };
}

export type LoginResponse = LoginSuccessResponse | LoginErrorResponse;

interface User {
  initials: string;
  pin: string;
  userid: number;
  name: string;
  role: string;
}

const users: User[] = [
  { initials: "admin", pin: "1122", userid: 1, name: "Hameed", role: "p" },
  { initials: "manager", pin: "2233", userid: 2, name: "John", role: "m" },
  { initials: "account", pin: "3344", userid: 3, name: "Alice", role: "a" },
  { initials: "builder", pin: "4455", userid: 4, name: "Bob", role: "b" },
  { initials: "principal", pin: "5566", userid: 5, name: "Sam", role: "p" },
];

export function loginUser(initials: string, pin: string): LoginResponse {
  const user = users.find(
    (user) =>
      user.initials.toLowerCase() === initials.toLowerCase() && user.pin === pin
  );

  if (user) {
    return {
      status: 1,
      payload: {
        userid: user.userid,
        name: user.name,
        role: user.role,
      },
    };
  } else {
    return {
      status: 0,
      payload: {
        message: "Could not login.",
      },
    };
  }
}

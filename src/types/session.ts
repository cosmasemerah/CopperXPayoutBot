import { UserSession } from "./auth";

/**
 * Session action types
 */
export enum SessionActionType {
  LOGIN = "login",
  SEND_EMAIL = "sendemail",
  SET_DEFAULT_WALLET = "setdefaultwallet",
  SEND_WALLET = "sendwallet",
  DEPOSIT = "deposit",
  WITHDRAW_BANK = "withdrawbank",
  HISTORY = "history",
  ADD_PAYEE = "addpayee",
  SEND_BATCH = "sendbatch",
}

/**
 * Session state interface
 */
export interface SessionState {
  currentAction?: SessionActionType;
  callbackData?: string;
  data?: Record<string, unknown>;
}

/**
 * Extended session interface with state and activity tracking
 */
export interface ExtendedSession extends UserSession {
  state?: SessionState;
  lastActivity: Date;
}

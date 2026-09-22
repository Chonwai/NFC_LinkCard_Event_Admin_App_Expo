import { TOKEN_STORAGE_KEY } from "@/constants/config";
import { tokenStorage } from "@/utils/storage";

/** 與 token 分離，避免登出清 token 時一併清掉「記住帳密」 */
const REMEMBERED_LOGIN_KEY = `${TOKEN_STORAGE_KEY}_remembered_login`;

export interface RememberedLogin {
  email: string;
  password: string;
}

/**
 * 記住上次成功登入的 Email／密碼，方便登出後快速再登。
 * Web＝localStorage；Native＝SecureStore（與 token 同通道）。
 */
export async function loadRememberedLogin(): Promise<RememberedLogin | null> {
  try {
    const raw = await tokenStorage.getItem(REMEMBERED_LOGIN_KEY);
    if (raw == null || raw === "") {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<RememberedLogin>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.password !== "string"
    ) {
      return null;
    }
    if (parsed.email.trim() === "" || parsed.password === "") {
      return null;
    }
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

export async function saveRememberedLogin(
  email: string,
  password: string,
): Promise<void> {
  const payload: RememberedLogin = { email: email.trim(), password };
  await tokenStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify(payload));
}

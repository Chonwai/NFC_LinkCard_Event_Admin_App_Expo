import { Platform, Vibration } from "react-native";

import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import type { CheckInOutcomeKind } from "@/types/check-in.types";

/** 現場感官回饋總開關（Settings 未接前預設開） */
export const CHECK_IN_FEEDBACK_ENABLED = true;

const SOUND_MODULES: Record<CheckInOutcomeKind, number> = {
  valid: require("../../assets/sounds/checkin-success.wav"),
  duplicate: require("../../assets/sounds/checkin-warn.wav"),
  invalid: require("../../assets/sounds/checkin-fail.wav"),
};

const VIBRATION_PATTERNS: Record<CheckInOutcomeKind, number | number[]> = {
  valid: 80,
  duplicate: [0, 60, 80, 60],
  invalid: [0, 120, 60, 120],
};

let player: AudioPlayer | null = null;

function vibrate(kind: CheckInOutcomeKind): void {
  if (Platform.OS === "web") return;
  try {
    Vibration.vibrate(VIBRATION_PATTERNS[kind]);
  } catch {
    // 模擬器／權限不足時忽略
  }
}

async function playSound(kind: CheckInOutcomeKind): Promise<void> {
  try {
    if (player) {
      player.remove();
      player = null;
    }
    player = createAudioPlayer(SOUND_MODULES[kind]);
    player.play();
  } catch {
    // 缺資源／Web 限制時降級為靜音
  }
}

/** 依簽到結果播放震動 + 音效（失敗不阻斷 UI） */
export async function playCheckInFeedback(
  kind: CheckInOutcomeKind,
): Promise<void> {
  if (!CHECK_IN_FEEDBACK_ENABLED) return;
  vibrate(kind);
  await playSound(kind);
}

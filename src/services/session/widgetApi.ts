import { WIDGET_HTML } from './widgetHtml.js';

/** Bot API 10.4 widget calls. grammy (1.43–1.46) has no typings for them, so they
 *  go through `api.raw`, a proxy that forwards any method name to Telegram. */
export interface RawApi {
  raw: unknown;
}

/** The `widget_query` update, as far as this bot reads it. */
export interface WidgetQuery {
  id: string;
  from: { id: number };
  data: string;
  chat?: { id: number };
  message_id?: number;
}

export type WidgetAnswer = 'ok' | 'expired' | 'error';

/** Shown under the widget, and alone on Telegram apps that cannot render widgets. */
export const WIDGET_CAPTION =
  "Can't see the card? Update Telegram, or switch off ✨ Rich cards in ⚙️ Settings.";

type RawMethods = Record<string, (payload: Record<string, unknown>) => Promise<unknown>>;
const raw = (api: RawApi): RawMethods => api.raw as RawMethods;

export async function sendWidgetCard(api: RawApi, chatId: number, chatData: string): Promise<number> {
  const msg = (await raw(api).sendWidget!({
    chat_id: chatId,
    html: WIDGET_HTML,
    chat_data: chatData,
    allow_queries: true,
    caption: WIDGET_CAPTION,
  })) as { message_id: number };
  return msg.message_id;
}

export async function editWidgetData(api: RawApi, chatId: number, messageId: number, chatData: string): Promise<void> {
  await raw(api).editMessageWidgetData!({ chat_id: chatId, message_id: messageId, chat_data: chatData });
}

export async function answerWidgetQuery(api: RawApi, queryId: string, data: WidgetAnswer): Promise<void> {
  await raw(api).answerWidgetQuery!({ widget_query_id: queryId, data });
}

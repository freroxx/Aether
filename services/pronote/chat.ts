import { PronoteApiClient } from "@/services/pronote/api-client";
import { Chat, Message, Recipient } from "@/services/shared/chat";
import { error } from "@/utils/logger/logger";

export async function fetchPronoteChats(
  authToken: string,
  accountId: string,
  childName?: string
): Promise<Chat[]> {
  try {
    const data = await PronoteApiClient.getChats(authToken, childName);
    return (data.chats || []).map((c: any) => ({
      id: c.id,
      subject: c.subject || "Discussion",
      creator: c.creator || "",
      recipient: c.recipient || "",
      date: new Date(c.date || Date.now()),
      createdByAccount: accountId,
      unread: typeof c.unread === "number" ? c.unread : 0,
      closed: Boolean(c.closed ?? false),
    }) as Chat);
  } catch (err) {
    error(`Failed to fetch chats: ${err}`, "fetchPronoteChats");
    return [];
  }
}

export async function fetchPronoteChatRecipients(
  authToken: string,
  chat: Chat,
  childName?: string
): Promise<Recipient[]> {
  try {
    const data = await PronoteApiClient.getChatRecipients(authToken, childName);
    return (data.recipients || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      type: r.type,
    }));
  } catch (err) {
    error(`Failed to fetch chat recipients: ${err}`, "fetchPronoteChatRecipients");
    return [];
  }
}

export async function fetchPronoteChatMessages(
  authToken: string,
  accountId: string,
  chat: Chat,
  childName?: string
): Promise<Message[]> {
  try {
    const data = await PronoteApiClient.getChatMessages(authToken, chat.id, childName);
    return (data.messages || []).map((m: any) => ({
      id: m.id,
      subject: "",
      content: m.content || "",
      author: m.author || "",
      date: new Date(m.date || Date.now()),
      attachments: [],
    }));
  } catch (err) {
    error(`Failed to fetch chat messages: ${err}`, "fetchPronoteChatMessages");
    return [];
  }
}

export async function sendPronoteMessageInChat(
  authToken: string,
  chat: Chat,
  content: string,
  childName?: string
): Promise<void> {
  await PronoteApiClient.sendChatMessage(authToken, chat.id, content, childName);
}

export async function fetchPronoteRecipients(
  authToken: string,
  childName?: string
): Promise<Recipient[]> {
  try {
    const data = await PronoteApiClient.getChatRecipients(authToken, childName);
    return (data.recipients || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      type: r.type,
    }));
  } catch (err) {
    error(`Failed to fetch recipients: ${err}`, "fetchPronoteRecipients");
    return [];
  }
}

export async function createPronoteMail(
  authToken: string,
  accountId: string,
  subject: string,
  content: string,
  recipients: Recipient[],
  childName?: string
): Promise<Chat> {
  try {
    const res = await PronoteApiClient.createChat(
      authToken,
      subject,
      content,
      recipients.map(r => r.id),
      childName
    );
    return {
      id: res.chat_id || `chat_${Date.now()}`,
      subject,
      recipient: recipients.map(r => r.name).join(", "),
      creator: "Moi",
      date: new Date(),
      createdByAccount: accountId,
    };
  } catch (err) {
    error(`Failed to create mail: ${err}`, "createPronoteMail");
    return {
      id: `chat_${Date.now()}`,
      subject,
      recipient: recipients.map(r => r.name).join(", "),
      creator: "Moi",
      date: new Date(),
      createdByAccount: accountId,
    };
  }
}
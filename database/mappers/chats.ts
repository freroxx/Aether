import { Attachment } from "@/services/shared/attachment";
import { Chat as SharedChat, Message as SharedMessage,Recipient as SharedRecipient } from "@/services/shared/chat";

import { Chat, Message, Recipient } from "../models/Chat";
import { parseJsonArray } from "../useHomework";

export function mapChatsToShared(data: Chat[]): SharedChat[] {
  return data.map(chat => {
    let labels: string[] | undefined;
    try {
      const raw = (chat as any).labelsRaw;
      labels = raw ? JSON.parse(raw) : undefined;
    } catch {
      labels = undefined;
    }
    return {
      fromCache: true,
      createdByAccount: chat.createdByAccount,
      id: chat.chatId,
      subject: chat.subject,
      recipient: chat.recipient,
      creator: chat.creator,
      date: new Date(chat.date),
      unread: (chat as any).unread ?? undefined,
      closed: (chat as any).closed ?? undefined,
      labels,
    };
  })
}

export function mapRecipientsToShared(data: Recipient[]): SharedRecipient[] {
  return data.map(recipient => {
    let functions: string[] | undefined;
    try {
      const raw = (recipient as any).functionsRaw;
      functions = raw ? JSON.parse(raw) : undefined;
    } catch {
      functions = undefined;
    }
    return {
      id: (recipient as any).recipientId ?? recipient.id,
      name: recipient.name,
      class: (recipient as any).class,
      type: (recipient as any).type ?? undefined,
      email: (recipient as any).email ?? undefined,
      functions,
      withDiscussion: (recipient as any).withDiscussion ?? undefined,
    };
  })
}

export function mapMessagesToShared(data: Message[]): SharedMessage[] {
  return data.map(message => ({
    id: (message as any).messageId ?? message.id,
    content: message.content,
    author: message.author,
    subject: message.subject,
    date: new Date(message.date),
    seen: (message as any).seen ?? undefined,
    replyingTo: (message as any).replyingTo ?? null,
    attachments: parseJsonArray(message.attachments) as Attachment[]
  }));
}
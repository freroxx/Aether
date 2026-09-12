// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { Model, Relation } from '@nozbe/watermelondb';
import { children, field, relation } from '@nozbe/watermelondb/decorators';

export class Chat extends Model {
  static table = 'chats';
	
  static associations = {
    recipients: { type: 'has_many', foreignKey: 'chatId' },
    messages: { type: 'has_many', foreignKey: 'chatId' },
  };

	@field('createdByAccount') createdByAccount: string;
	@field('chatId') chatId: string;
	@field('subject') subject: string;
	@field('recipient') recipient?: string;
	@field('creator') creator?: string;
	@field('date') date: number;
	@field('unread') unread?: number;
	@field('closed') closed?: boolean;
	@field('labelsRaw') labelsRaw?: string;
	@children('recipients') recipients?: Relation<Recipient>;
	@children('messages') messages?: Relation<Message>;
}

export class Recipient extends Model {
  static table = 'recipients';

  static associations = {
    chats: { type: 'belongs_to', key: 'chatId' },
  };

	@field('recipientId') recipientId: string;
	@field('name') name: string;
	@field('class') class?: string;
	@field('type') type?: string;
	@field('email') email?: string;
	@field('functionsRaw') functionsRaw?: string;
	@field('withDiscussion') withDiscussion?: boolean;
	@field('chatId') chatId: string;
	@relation('chats', 'chatId') chat: Chat;
}

export class Message extends Model {
  static table = 'messages';

  static associations = {
    chats: { type: 'belongs_to', key: 'chatId' },
  };

	@field('messageId') messageId: string;
	@field('content') content: string;
	@field('author') author: string;
	@field('subject') subject: string;
	@field('date') date: number;
	@field('seen') seen?: boolean;
	@field('replyingTo') replyingTo?: string;
	@field('attachments') attachments: string;
	@field('chatId') chatId: string;
	@relation('chats', 'chatId') chat: Chat;
}
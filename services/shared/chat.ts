import { Attachment } from "@/services/shared/attachment";
import { GenericInterface } from "@/services/shared/types";

export interface Chat extends GenericInterface {
  id: string;
  subject: string;
  recipient?: string;
  creator?: string;
  date: Date;
  unread?: number;
  closed?: boolean;
  replyable?: boolean;
  labels?: string[];
  ref?: any;
}

export interface Recipient {
  id: string;
  name: string;
  class?: string;
  type?: string;
  email?: string;
  functions?: string[];
  withDiscussion?: boolean;
  ref?: any;
}

export interface Message {
  id: string;
  content: string;
  author: string;
  subject: string;
  date: Date;
  seen?: boolean;
  replyingTo?: string | null;
  attachments: Attachment[]
}
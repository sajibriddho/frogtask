/**
 * Setting – flexible key/value store for system-wide configuration.
 * Collection: settings
 *
 * Rather than one column per setting (which scales badly and requires a
 * schema change every time a new setting is added), we store one document
 * per setting with a `scope` + `key` compound index.
 *
 *   { scope: "general", key: "company_name", value: "Acme Farms" }
 *   { scope: "email",   key: "smtp_password",    value: "<encrypted>", isSecret: true }
 *
 * `value` is `Schema.Types.Mixed` so it can hold strings, numbers, booleans
 * or small structured objects without another migration. Secret values are
 * AES-GCM encrypted at rest (see src/lib/settings-crypto.ts) and surfaced
 * to the UI as masked placeholders until the user overwrites them.
 */

import mongoose, { Document, Schema } from "mongoose";

export type SettingValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>;

export interface ISetting extends Document {
  scope: string;
  key: string;
  value: SettingValue;
  isSecret: boolean;
  updatedBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    scope: { type: String, required: true, trim: true, index: true },
    key: { type: String, required: true, trim: true },
    value: { type: Schema.Types.Mixed, default: null },
    isSecret: { type: Boolean, default: false },
    updatedBy: {
      type: new Schema(
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { collection: "settings", timestamps: true },
);

settingSchema.index({ scope: 1, key: 1 }, { unique: true });

const Setting =
  (mongoose.models.Setting as mongoose.Model<ISetting>) ||
  mongoose.model<ISetting>("Setting", settingSchema);

export default Setting;

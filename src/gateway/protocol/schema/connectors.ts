import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

const ConnectorTypeSchema = Type.Union([
  Type.Literal("app"),
  Type.Literal("custom_api"),
  Type.Literal("custom_mcp"),
]);

const ConnectorStatusSchema = Type.Union([
  Type.Literal("connected"),
  Type.Literal("disconnected"),
  Type.Literal("error"),
  Type.Literal("draft"),
]);

const ConnectorTransportSchema = Type.Union([
  Type.Literal("http"),
  Type.Literal("sse"),
  Type.Literal("stdio"),
  Type.Literal("websocket"),
]);

const ConnectorAuthModeSchema = Type.Union([
  Type.Literal("none"),
  Type.Literal("api_key"),
  Type.Literal("oauth"),
]);

const ConnectorOAuthSchema = Type.Object(
  {
    connected: Type.Optional(Type.Boolean()),
    connectedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    expiresAt: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

const ConnectorOAuthProviderConfigSchema = Type.Object(
  {
    authorizeUrl: Type.Optional(Type.String()),
    tokenUrl: Type.Optional(Type.String()),
    clientId: Type.Optional(Type.String()),
    clientSecret: Type.Optional(Type.String()),
    scopes: Type.Optional(Type.Array(Type.String())),
    extraAuthorizeParams: Type.Optional(Type.Record(Type.String(), Type.String())),
    extraTokenParams: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

const ConnectorSummarySchema = Type.Object(
  {
    id: NonEmptyString,
    type: ConnectorTypeSchema,
    name: NonEmptyString,
    description: Type.Optional(Type.String()),
    icon: Type.Optional(Type.String()),
    status: ConnectorStatusSchema,
    builtin: Type.Optional(Type.Boolean()),
    enabled: Type.Optional(Type.Boolean()),
    authMode: Type.Optional(ConnectorAuthModeSchema),
    oauthProvider: Type.Optional(Type.String()),
    oauthProviderConfig: Type.Optional(ConnectorOAuthProviderConfigSchema),
    oauth: Type.Optional(ConnectorOAuthSchema),
  },
  { additionalProperties: false },
);

export const ConnectorsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const ConnectorsListResultSchema = Type.Object(
  {
    items: Type.Array(ConnectorSummarySchema),
  },
  { additionalProperties: false },
);

export const ConnectorsUpsertParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    type: ConnectorTypeSchema,
    name: NonEmptyString,
    description: Type.Optional(Type.String()),
    icon: Type.Optional(Type.String()),
    enabled: Type.Optional(Type.Boolean()),
    authMode: Type.Optional(ConnectorAuthModeSchema),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

export const ConnectorsDeleteParamsSchema = Type.Object(
  {
    id: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ConnectorsOAuthStartParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    callbackUrl: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ConnectorsOAuthStartResultSchema = Type.Object(
  {
    authorizeUrl: NonEmptyString,
    state: NonEmptyString,
    expiresAt: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const ConnectorsOAuthCompleteParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    callbackUrl: NonEmptyString,
    state: NonEmptyString,
    code: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ConnectorsOAuthStatusParamsSchema = Type.Object(
  {
    id: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ConnectorsOAuthStatusResultSchema = Type.Object(
  {
    id: NonEmptyString,
    status: ConnectorStatusSchema,
    connectedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    expiresAt: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const ConnectorsSessionGetParamsSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ConnectorsSessionGetResultSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    connectorIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ConnectorsSessionSetParamsSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    connectorIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export {
  ConnectorAuthModeSchema,
  ConnectorStatusSchema,
  ConnectorTransportSchema,
  ConnectorTypeSchema,
};

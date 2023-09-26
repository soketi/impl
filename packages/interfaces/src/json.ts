export type JsonObject = { [key: string]: JsonValue; };
export type JsonArray = JsonValue[]|JsonObject[];
export type JsonValue = Date|RegExp|string|number|boolean|null|JsonObject|any;
export type JsonStringifiable = JsonObject|JsonObject[]|JsonArray|JsonArray[];

import { Logger, type LogLevel } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AppModule } from "./app.module";

loadLocalEnv();

async function bootstrap() {
  const loggerLevels = parseLogLevels(process.env.LOG_LEVELS);
  const app = await NestFactory.create(AppModule, {
    logger: loggerLevels,
  });
  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  new Logger("Bootstrap").log(
    `Application started port=${port} logLevels=${loggerLevels.join(",")}`,
  );
}

void bootstrap();

function loadLocalEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const rawEnv = readFileSync(envPath, "utf8");

  for (const line of rawEnv.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseLogLevels(value: string | undefined): LogLevel[] {
  if (!value) {
    return ["log", "warn", "error"];
  }

  const allowedLevels = new Set<LogLevel>([
    "log",
    "error",
    "warn",
    "debug",
    "verbose",
    "fatal",
  ]);
  const levels = value
    .split(",")
    .map((level) => level.trim())
    .filter((level): level is LogLevel =>
      allowedLevels.has(level as LogLevel),
    );

  return levels.length > 0 ? levels : ["log", "warn", "error"];
}

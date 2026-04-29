import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { config as loadDotenv } from "dotenv"

loadDotenv({ path: resolve(process.cwd(), ".env") })

function runStep(command: string, args: string[], label: string) {
  console.log(`\n>>> ${label}`)

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function main() {
  const schemaPath = resolve(process.cwd(), "prisma", "schema.prisma")
  const cleanupSqlPath = resolve(process.cwd(), "scripts", "prisma-pre-db-push.sql")
  const pushArgs = process.argv.slice(2)
  const finalPushArgs = pushArgs.includes("--skip-generate")
    ? pushArgs
    : [...pushArgs, "--skip-generate"]

  runStep("npx", ["prisma", "db", "execute", "--file", cleanupSqlPath, "--schema", schemaPath], "清理历史 DELETED 数据")
  runStep("npx", ["prisma", "db", "push", ...finalPushArgs], "同步数据库结构")
}

main()

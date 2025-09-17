import { parseArgs } from "@std/cli/parse-args";
import { bold, green, red, yellow } from "@std/fmt/colors";
import { ConfigManager } from "../../config/manager.ts";
import { NocoDBClient } from "../../api/nocodb.ts";
import { ThingsClient } from "../../api/things.ts";

export async function testCommand(
  args: string[],
  _globalFlags: Record<string, unknown>,
): Promise<void> {
  const flags = parseArgs(args, {
    boolean: ["help", "nocodb", "things"],
    alias: {
      h: "help",
      n: "nocodb",
      t: "things",
    },
  });

  if (flags.help) {
    printTestHelp();
    return;
  }

  const config = await ConfigManager.load();
  const testAll = !flags.nocodb && !flags.things;

  console.log(bold("\nTesting Connections"));
  console.log("─".repeat(50));

  let allTestsPassed = true;

  // Test NocoDB
  if (testAll || flags.nocodb) {
    console.log(bold("\n🔌 Testing NocoDB connection..."));

    if (!config.get("nocodbUrl") || !config.get("nocodbToken")) {
      console.log(red("  ✗ NocoDB not configured"));
      console.log(yellow("    Run 'nocodb-things config --set' first"));
      allTestsPassed = false;
    } else {
      try {
        const client = new NocoDBClient(config);
        const result = await client.testConnection();

        if (result.success) {
          console.log(green("  ✓ NocoDB connection successful"));
          console.log(`    • API Version: ${result.version}`);
          console.log(`    • Projects: ${result.projectCount}`);

          if (config.get("tableId")) {
            const tableTest = await client.testTable();
            if (tableTest.success) {
              console.log(
                green(`  ✓ Table '${config.get("tableId")}' accessible`),
              );
              console.log(`    • Columns: ${tableTest.columnCount}`);
              console.log(`    • Records: ${tableTest.recordCount}`);
            } else {
              console.log(
                red(`  ✗ Table '${config.get("tableId")}' not accessible`),
              );
              console.log(`    Error: ${tableTest.error}`);
              allTestsPassed = false;
            }
          } else {
            console.log(yellow("  ⚠ No table ID configured"));
          }
        } else {
          console.log(red("  ✗ NocoDB connection failed"));
          console.log(`    Error: ${result.error}`);
          allTestsPassed = false;
        }
      } catch (error) {
        console.log(red("  ✗ NocoDB connection failed"));
        console.log(`    Error: ${error.message}`);
        allTestsPassed = false;
      }
    }
  }

  // Test Things
  if (testAll || flags.things) {
    console.log(bold("\n🗂️  Testing Things connection..."));

    try {
      const client = new ThingsClient();
      const result = await client.testConnection();

      if (result.success) {
        console.log(green("  ✓ Things is installed and accessible"));
        console.log(`    • Version: ${result.version}`);

        // Test URL scheme
        const urlTest = await client.testUrlScheme();
        if (urlTest.success) {
          console.log(green("  ✓ URL scheme registered"));
        } else {
          console.log(yellow("  ⚠ URL scheme may not be properly registered"));
        }

        // Test AppleScript
        const scriptTest = await client.testAppleScript();
        if (scriptTest.success) {
          console.log(green("  ✓ AppleScript interface working"));
          console.log(`    • Tasks: ${scriptTest.taskCount}`);
          console.log(`    • Projects: ${scriptTest.projectCount}`);
        } else {
          console.log(red("  ✗ AppleScript interface not working"));
          console.log(`    Error: ${scriptTest.error}`);
          allTestsPassed = false;
        }
      } else {
        console.log(red("  ✗ Things not detected"));
        console.log(`    Error: ${result.error}`);
        console.log(yellow("    Make sure Things 3 is installed"));
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(red("  ✗ Things connection failed"));
      console.log(`    Error: ${error.message}`);
      allTestsPassed = false;
    }
  }

  // Summary
  console.log("\n" + "─".repeat(50));
  if (allTestsPassed) {
    console.log(green(bold("✓ All tests passed!")));
    console.log("Your system is ready for synchronization.");
  } else {
    console.log(red(bold("✗ Some tests failed")));
    console.log("Please fix the issues above before attempting to sync.");
    Deno.exit(1);
  }
}

function printTestHelp(): void {
  console.log(`
${bold("TEST COMMAND")}
Test connections to NocoDB and Things

${bold("USAGE:")}
  nocodb-things test [options]

${bold("OPTIONS:")}
  -h, --help     Show this help message
  -n, --nocodb   Test only NocoDB connection
  -t, --things   Test only Things connection

${bold("EXAMPLES:")}
  nocodb-things test              # Test all connections
  nocodb-things test --nocodb     # Test only NocoDB
  nocodb-things test --things     # Test only Things
`);
}

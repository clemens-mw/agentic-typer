import { exec } from "child_process";
import { promisify } from "util";
import { orange } from "./console-colors.ts";

const execAsync = promisify(exec);

export async function npmInstallDevDependencies(
  packages: string[],
  cwd: string,
): Promise<string> {
  const command = `npm i -D ${packages.join(" ")}`;
  console.log(`Installing dev dependencies: ${command}`);
  const result = await execAsync(command, { cwd });
  if (result.stderr) {
    console.error(orange(`Error installing packages: ${result.stderr}`));
  }
  console.log(`Successfully installed.`);
  return result.stdout;
}

export async function npmViewPackageVersion(
  packageSpec: string,
  cwd: string,
): Promise<string> {
  const command = `npm view ${packageSpec} version`;
  const result = await execAsync(command, { cwd });
  if (result.stderr) {
    console.error(orange(`Error fetching package version: ${result.stderr}`));
  }
  return result.stdout;
}

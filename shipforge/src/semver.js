const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/u;

export function assertSemver(value) {
  if (!SEMVER.test(value)) {
    throw new Error(`Invalid semantic version: ${value}`);
  }
  return value;
}

export function androidVersionCode(version) {
  const match = SEMVER.exec(assertSemver(version));
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major > 99 || minor > 99 || patch > 99) {
    throw new Error('Android automatic versionCode supports components from 0 to 99.');
  }
  return major * 10000 + minor * 100 + patch;
}

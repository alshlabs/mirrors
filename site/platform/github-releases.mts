import { sh } from "./sh.mts";

export type GithubReleaseCreateOptions = {
  repo: string;
  tag: string;
  title: string;
  draft?: boolean;
  notes?: string;
};

export async function githubReleaseCreate({
  repo,
  tag,
  title,
  draft,
  notes,
}: GithubReleaseCreateOptions): Promise<void> {
  await sh("gh", [
    "release",
    "create",
    tag,
    ...["--repo", repo],
    ...["--title", title],
    ...[`--draft=${draft}`],
    ...(notes ? ["--notes", notes] : []),
  ]);
}

export type GithubReleaseEditOptions = {
  repo: string;
  tag: string;
  title?: string;
  draft?: boolean;
  notes?: string;
};

export async function githubReleaseEdit({
  repo,
  tag,
  title,
  draft,
  notes,
}: GithubReleaseEditOptions): Promise<void> {
  await sh("gh", [
    "release",
    "edit",
    tag,
    ...["--repo", repo],
    ...[`--draft=${draft}`],
    ...(title ? ["--title", title] : []),
    ...(notes ? ["--notes", notes] : []),
  ]);
}

export async function githubReleaseDelete({
  repo,
  tag,
}: GithubReleaseEditOptions): Promise<void> {
  await sh("gh", [
    "release",
    "delete",
    tag,
    ...["--repo", repo],
    ...[`--yes`],
    ...[`--cleanup-tag`],
  ]);
}

export type GithubReleaseDeleteAllOptions = {
  repo: string;
  tag: string;
};

/// Deletes every release (published or draft) that points at the given tag.
/// Unlike `githubReleaseDelete` this does not throw when the release does not
/// exist and it also cleans up orphaned draft releases, which can be left
/// behind by an interrupted run and which make `gh release upload` fail with
/// "asset under the same name already exists".
export async function githubReleaseDeleteAll({
  repo,
  tag,
}: GithubReleaseDeleteAllOptions): Promise<void> {
  try {
    const filter = `.[] | select(.tag_name == ${JSON.stringify(tag)}) | .id`;
    const result = await sh(
      "gh",
      [
        "api",
        `repos/${repo}/releases?per_page=100`,
        ...["--paginate"],
        ...["--jq", filter],
      ],
      { stdio: "pipe" },
    );

    const ids = result.stdout
      .split("\n")
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id));

    for (const id of ids) {
      console.log(`[${tag}] DELETING_EXISTING_RELEASE: ${id}`);
      await sh(
        "gh",
        ["api", "-X", "DELETE", `repos/${repo}/releases/${id}`],
        { stdio: "pipe" },
      );
    }
  } catch (error) {
    console.log(`[${tag}] FAILED_TO_CLEAN_UP_EXISTING_RELEASE`);
    console.log({ error });
  }
}

export type GithubReleaseUploadOptions = {
  repo: string;
  tag: string;
  file: string;
  clobber?: boolean;
};

export async function githubReleaseUpload({
  repo,
  tag,
  file,
  clobber,
}: GithubReleaseUploadOptions): Promise<void> {
  await sh("gh", [
    "release",
    "upload",
    tag,
    file,
    ...["--repo", repo],
    ...(clobber ? ["--clobber"] : []),
  ]);
}

export type GithubReleaseListOptions = {
  repo: string;
};

export async function githubReleaseList({
  repo,
}: GithubReleaseListOptions): Promise<void> {
  const result = await sh(
    "gh",
    [
      "release",
      "list",
      ...["--repo", repo],
      ...["--json", "id"],
      ...["--json", "name"],
      ...["--json", "tagName"],
    ],
    { stdio: "pipe" },
  );
  if (result.code === 0) {
    console.log(JSON.parse(result.stdout));
  } else {
    throw new Error("Command failed");
  }
}

export type GithubReleaseViewOptions = {
  repo: string;
  tag: string;
};

export async function githubReleaseView<T = unknown>({
  repo,
  tag,
}: GithubReleaseViewOptions): Promise<
  {
      id: string;
      name: string;
      tagName: string;
      body: T;
    }
  > {
  const result = await sh(
    "gh",
    [
      "release",
      "view",
      tag,
      ...["--repo", repo],
      ...["--json", "id"],
      ...["--json", "name"],
      ...["--json", "tagName"],
      ...["--json", "body"],
    ],
    { stdio: "pipe" },
  );
  if (result.code === 0) {
    const parsed = JSON.parse(result.stdout)
    try {
      parsed.body = JSON.parse(parsed.body)
    } catch {
      // Body is not JSON (empty or hand-written notes), leave it as a string
    }
    return parsed;
  } else {
    throw new Error("Command failed" + result.stdout + result.stderr);
  }
}

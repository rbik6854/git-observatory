import { LessonChapter, VisualizationScene } from "@git-observatory/core-domain";

function scene(
  id: string,
  title: string,
  type: VisualizationScene["type"],
  summary: string,
  emphasizedStructures: VisualizationScene["emphasizedStructures"],
  glossaryTerms: string[],
  callouts: VisualizationScene["callouts"]
): VisualizationScene {
  return {
    id,
    title,
    type,
    summary,
    emphasizedStructures,
    glossaryTerms,
    callouts
  };
}

export const lessonChapters: LessonChapter[] = [
  {
    id: "chapter-1-repository-birth",
    title: "Chapter 1: Git Creates a Repository",
    summary: "Start with an empty folder and watch Git create its hidden control room.",
    status: "interactive",
    outcomes: [
      "Understand why .git exists",
      "Spot HEAD, refs, objects, and config",
      "See what changes immediately after git init"
    ],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: [
      {
        id: "step-init-repository",
        title: "Initialize a repository",
        prompt: "This folder is empty. Ask Git to turn it into a repository and then inspect the hidden .git directory.",
        guidedActionLabel: "Initialize Repository",
        guidedActionKind: "git-command",
        suggestedCommand: "git init",
        requiredFiles: [],
        setupState: "empty-directory",
        validationRule: "git-init",
        primaryScene: scene(
          "repo-birth-scene",
          "Repository Birth Scene",
          "repo-birth",
          "The folder is unchanged, but Git creates .git and seeds it with HEAD, refs, config, and object storage.",
          ["git-directory", "head", "refs"],
          ["repository", "HEAD", "refs", "objects", "config"],
          [
            {
              id: "callout-head",
              title: "HEAD appears",
              description: "HEAD is Git's pointer to the currently checked out branch or commit.",
              target: "HEAD"
            },
            {
              id: "callout-objects",
              title: "Object storage is ready",
              description: "Git prepares the objects directory before any blobs, trees, or commits exist.",
              target: "objects"
            }
          ]
        ),
        detailPanels: ["git-directory", "refs", "glossary", "stdout", "stderr"],
        plainEnglishExplanation:
          "git init does not track your files yet. It creates the Git database and the files Git will use to remember history.",
        deepDiveExplanation:
          "After git init, Git creates .git/HEAD, a refs directory, object storage directories, and config scaffolding. At this point there are still no commit, tree, or blob objects."
      }
    ]
  },
  {
    id: "chapter-2-working-tree",
    title: "Chapter 2: Git Notices Files but Stores Nothing Yet",
    summary: "Create a file inside the app and see that Git only reports it as untracked until you stage it.",
    status: "interactive",
    outcomes: [
      "Create files without leaving the lesson",
      "Understand untracked status",
      "Separate the working tree from Git's stored objects"
    ],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: [
      {
        id: "step-create-readme",
        title: "Create README.md",
        prompt: "Add a README file in the in-app workspace. Git will notice it, but it still will not store the contents as an object.",
        guidedActionLabel: "Create README.md",
        guidedActionKind: "workspace-file-create",
        requiredFiles: [
          {
            path: "README.md",
            content: "# Git Internals\n\nThis repository is my first learning sandbox.\n",
            description: "A simple file that becomes the first blob in the repository."
          }
        ],
        setupState: "git-initialized",
        validationRule: "workspace-file-exists",
        primaryScene: scene(
          "workspace-scene",
          "Working Tree Scene",
          "workspace-status",
          "The working tree now has a file Git can see, but the object database is still unchanged.",
          ["working-tree"],
          ["working tree", "untracked file", "repository database"],
          [
            {
              id: "callout-untracked",
              title: "Untracked means unseen by history",
              description: "Git sees the file in the folder but has not stored its contents or staged it yet.",
              target: "README.md"
            }
          ]
        ),
        detailPanels: ["working-tree", "git-directory", "glossary"],
        plainEnglishExplanation:
          "Creating a file changes your folder, not Git history. Git can report that it exists, but it has not stored the file content yet.",
        deepDiveExplanation:
          "At this stage the working tree differs from Git's last known state. There is no blob object for README.md until staging or low-level hashing occurs."
      }
    ]
  },
  {
    id: "chapter-3-blob-and-index",
    title: "Chapter 3: Git Turns File Content into Blob Objects",
    summary: "Stage the file and watch content move into the object database and index.",
    status: "interactive",
    outcomes: [
      "See a blob object appear",
      "Understand the index as a mapping from paths to object ids",
      "See why git add is not the same as commit"
    ],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: [
      {
        id: "step-stage-readme",
        title: "Stage README.md",
        prompt: "Stage the README so Git hashes its content into a blob and records an index entry for the path.",
        guidedActionLabel: "Stage README.md",
        guidedActionKind: "git-command",
        suggestedCommand: "git add README.md",
        requiredFiles: [
          {
            path: "README.md",
            content: "# Git Internals\n\nThis repository is my first learning sandbox.\n"
          }
        ],
        setupState: "workspace-file-created",
        validationRule: "git-add-readme",
        primaryScene: scene(
          "add-pipeline-scene",
          "Working Tree / Index / Object Store Pipeline",
          "add-pipeline",
          "Git hashes the file into a blob and places a pointer to that blob in the index.",
          ["working-tree", "index", "objects"],
          ["blob", "hash", "index", "staging area"],
          [
            {
              id: "callout-blob",
              title: "Blob object appears",
              description: "The file content is now stored as a content-addressed blob object.",
              target: "blob"
            },
            {
              id: "callout-index",
              title: "Index entry points at the blob",
              description: "The path README.md now maps to the blob's object id in the index.",
              target: "index"
            }
          ]
        ),
        detailPanels: ["working-tree", "index", "objects", "glossary", "stdout", "stderr"],
        plainEnglishExplanation:
          "git add does two important things: it stores file content as a blob and updates the index to say which content should go into the next commit.",
        deepDiveExplanation:
          "Git writes a loose blob object under .git/objects and updates the binary index file so the path points at the blob object id, mode, and stage."
      }
    ]
  },
  {
    id: "chapter-4-tree-and-commit",
    title: "Chapter 4: Git Builds Trees and Commits",
    summary: "Turn staged content into a commit and see branch refs move.",
    status: "interactive",
    outcomes: [
      "See tree and commit objects appear",
      "Understand how a commit points to a tree",
      "Watch the branch ref and HEAD move"
    ],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: [
      {
        id: "step-commit-readme",
        title: "Create the first commit",
        prompt: "Commit the staged file. Git will create a tree object, then a commit object, then move the current branch ref.",
        guidedActionLabel: "Create First Commit",
        guidedActionKind: "git-command",
        suggestedCommand: "git commit -m \"Initial commit\"",
        requiredFiles: [
          {
            path: "README.md",
            content: "# Git Internals\n\nThis repository is my first learning sandbox.\n"
          }
        ],
        setupState: "readme-staged",
        validationRule: "git-commit-initial",
        primaryScene: scene(
          "commit-constructor-scene",
          "Commit Constructor",
          "commit-constructor",
          "The index becomes a tree, the tree is referenced by a commit, and the branch ref moves to the new commit.",
          ["index", "objects", "refs", "head", "graph"],
          ["tree object", "commit object", "branch ref", "symbolic HEAD", "parent pointer"],
          [
            {
              id: "callout-tree",
              title: "Tree object is created",
              description: "Git materializes the staged file paths into a tree object that describes the repository snapshot.",
              target: "tree"
            },
            {
              id: "callout-branch",
              title: "Branch ref moves",
              description: "Your current branch now points at the new commit, and HEAD still points at that branch.",
              target: "refs/heads/main"
            }
          ]
        ),
        detailPanels: ["index", "objects", "refs", "graph", "git-directory", "stdout", "stderr", "glossary"],
        plainEnglishExplanation:
          "git commit does not store files directly. It stores a tree of paths, then a commit that points to that tree, and then moves your branch to that commit.",
        deepDiveExplanation:
          "Git serializes the staged directory structure into a tree object, creates a commit object with metadata and the tree pointer, then updates the current branch ref that HEAD is following."
      }
    ]
  },
  {
    id: "chapter-5-refs-and-head",
    title: "Chapter 5: Git Moves Branches and HEAD",
    summary: "Branches are movable refs and HEAD usually points to one of them.",
    status: "planned",
    outcomes: ["Understand symbolic HEAD", "See branch refs diverge", "Inspect detached HEAD"],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: []
  },
  {
    id: "chapter-6-integration",
    title: "Chapter 6: Git Combines Histories",
    summary: "Merges change refs, commit graphs, and sometimes the index stages.",
    status: "planned",
    outcomes: ["See merge parents", "Inspect conflicts", "Understand merge state files"],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: []
  },
  {
    id: "chapter-7-rewrite",
    title: "Chapter 7: Git Rewrites History",
    summary: "Rebase and cherry-pick replay commits by creating new ones.",
    status: "planned",
    outcomes: ["Understand rewritten commit ids", "See rebase state files", "Compare old and new graphs"],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: []
  },
  {
    id: "chapter-8-remotes",
    title: "Chapter 8: Git Talks to Remotes",
    summary: "Fetch, pull, and push change remote-tracking refs and synchronize objects.",
    status: "planned",
    outcomes: ["See remote-tracking refs", "Understand pull as fetch plus integration", "Inspect divergence"],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: []
  },
  {
    id: "chapter-9-recovery",
    title: "Chapter 9: Git Recovers Lost Work",
    summary: "Reset, restore, revert, and reflog reveal how Git can recover state.",
    status: "planned",
    outcomes: ["Understand reflog", "Recover moved refs", "See dangling commits"],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: []
  },
  {
    id: "chapter-10-storage",
    title: "Chapter 10: Git Optimizes Storage",
    summary: "Packfiles and garbage collection explain how large repositories stay efficient.",
    status: "planned",
    outcomes: ["Loose vs packed objects", "Reachability", "Maintenance internals"],
    learningSections: ["Observe", "Try", "Explain", "Explore deeper"],
    steps: []
  }
];

export const interactiveLessonSteps = lessonChapters
  .filter((chapter) => chapter.status === "interactive")
  .flatMap((chapter) => chapter.steps);

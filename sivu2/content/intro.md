![Markdown Logo](/sivu2/sivulogo_valmis.png)

# Sivu (v.0.1)
---
Sivu is PHP-inspired server-side scripting DSL, built on top of Express server. The goal of Sivu is to bring back the joy of writing simple PHP websites, while also utilizing modern Node.js ecosystem and built-in security standards. 
<br><br>
Sivu abstracts away the normal routing code and lets you architect your app by structuring files.
## Sivu project structure:
Root folder is where your backend logic lives. Only files that end with `.sivu`-extension and are <b>NOT</b> prefixed with `_` are publicly available on web. With the help of `config.allow_pretty_urls` you can also access these files without the `.sivu`-extension on the web. For example: `/api/results.json.sivu` can also be accessed from `/api/results.json`.
```
├── config.js
├── data
│   ├── database.db
├── log
│   ├── access.log
├── public
│   └── styles.css
└── root
    └── api
        └── results.json.sivu   // json GET result
    ├── sitemap.xml.sivu        // dynamic sitemap
    ├── _post_route.sivu        // form action
    ├── _my-module.js           // backend module
    ├── _header.sivu            // partial
    ├── _layout.sivu            // layout engine with $yield() for views
    └── index.sivu              // view
```

## index.sivu (View example)
```html
<?meta 
  rateLimit 500
  rateWindow 60000
  useLayout true
?>

<?sivu
  const { formatDate } = await $import("./format.js");
  let title = "Sivu Todo Example";
  const todos = await db.query("SELECT * FROM todos");
?>

<?include "_header.sivu"?>

<!-- Call post requests without the "_"-prefix -->
<form method="POST" action="/add_todo.sivu">
  <?= $csrf($_SESSION) ?>
  <label for="taskname">Task name</label><br>
  <input type="text" id="taskname" name="taskname"><br>
  <label for="duedate">Task duedate</label><br>
  <input type="datetime-local" id="duedate" name="duedate"><br>
  <button type="submit">Add Todo</button>
</form>

<?sivu for (const todo of todos) { ?>
    <h4><?= todo.task_name ?></h4>
    <?= formatDate(todo.due) ?>
    <form method="POST" action="/delete_todo.sivu">
      <?= $csrf($_SESSION) ?>
      <input type="hidden" id="id" name="id" value="<?= todo.id; ?>"><br>
      <button type="submit">Delete</button>
    </form>
<?sivu } ?>

<?sivu
  console.log("server says hello!");
?>

<script nonce="<?= $nonce(); ?>">
  console.log("client says hello!");
</script>

<?sivu
  $_SESSION.user = {name: "Jane Doe"}
  const user = $_SESSION.user;
  if (user) {
    $echo($html("<p>Welcome, " + user.name + "</p>"));
  } else {
    $echo($html('<p class="error">You are not logged in.</p>'));
  }
?>
```
## result.json.sivu (dynamic json example)
```html
<?meta  
  useLayout false
  rateLimit 5
  rateWindow 5000 
?>
<?sivu
  $header('content-type', 'application/json');
  $status(200);

  const obj = {};
  for (let i = 0; i < 100; i++) {
    obj["field " + i] = "value " + i;
  }

  $echo($raw(JSON.stringify(obj)));
?>
```

## _post_route.sivu (post route example)
Notice that post route files should start with "_"-prefix, but when calling them in the forms you should leave it out.
```html
<?sivu
  const taskName = $_POST.taskname;
  const taskDue = $_POST.duedate;

  db.run("INSERT INTO todos (task_name, due) VALUES (?, ?)", [taskName, taskDue]);

  $flash("success", "Task added!");
  $redirect(`/?action=task_added`);
?>
```
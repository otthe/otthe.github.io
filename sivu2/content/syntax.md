# Syntax

Sivu uses PHP-style tags.

## Snippets
Sivu syntax includes:
- Script-tags
- Expressions
- Includes
- Meta-tags
---
### Scripts
Scripts allow you to embed server-executed javascript code inside the templates. Despite that, you can and you should write more complex js code into it's own modules and just utilize built-in function `$import` to call functions from that module.
```html
<?sivu
  const {myFunc} = await $import("./my-module.js");
  $header('content-type', 'text/html');
  const todos = await db.query("SELECT * FROM todos");
  myFunc();
?>

<!-- You can also utilize script tags on control flow -->
<?sivu for (const todo of todos) { ?>
    <h4><?= todo.task_name ?></h4>
    <?= formatDate(todo.due) ?>
    <form method="POST" action="/delete_todo.sivu">
      <?= $csrf($_SESSION) ?>
      <input type="hidden" id="id" name="id" value="<?= todo.id; ?>"><br>
      <button type="submit">Delete</button>
    </form>
<?sivu } ?>
```

---
### Expressions
Expressions allow you to add embed server-side render information to templates.
```html
<script nonce="<?= $nonce(); ?>"></script>
<?= "value" ?>
<?= 1 ?>
<?= $raw($dump($_SERVER)); ?>
```
Notice that the `config.autoescape_html` -might affect how the output is rendered

---
### Includes
Include-tags allows you to insert partial templates inside templates. 
```html
<!-- Inside index.sivu -->

<?sivu
  let title="Header title!";
?>
<?include "_header.sivu"?>
```
Notice that all variables are shared between template files. So in this example the `title`-variable can be called inside `_header.sivu`. <b>If you don't want the partial file to be directly accessible you should add `_`-prefix to it!</b>

---
### Metadata
You can include template specific metadata on top of the template. This data will be read into memory during server startup. Currently supported metadata fields are: 
```html
<?meta 
  rateLimit 500
  rateWindow 60000
  useLayout true
?>
```
These will allow you to setup in-memory, per-ip rate limiting and decide if the served file should use layout engine or not.
<script setup>
var props = defineProps({
  book: { type: Object, required: true }
});

var reading = useReading();
var labels = reading.labels;
var title = ref(props.book.title);
var author = ref(props.book.author);
var status = ref(props.book.status);
var memo = ref(props.book.memo);

watch(function () { return props.book; }, function (book) {
  title.value = book.title;
  author.value = book.author;
  status.value = book.status;
  memo.value = book.memo;
});

function save() {
  reading.saveBook(props.book.id, {
    title: title.value,
    author: author.value,
    status: status.value,
    memo: memo.value
  });
}

function remove() {
  if (window.confirm("この本を削除しますか？")) {
    reading.deleteBook(props.book.id);
  }
}
</script>

<template>
  <article class="book">
    <div class="row">
      <label>題名
        <input v-model="title" class="title-input" maxlength="80">
      </label>
      <label>著者
        <input v-model="author" class="author-input" maxlength="80">
      </label>
      <label>状態
        <select v-model="status">
          <option v-for="(label, value) in labels" :key="value" :value="value">{{ label }}</option>
        </select>
      </label>
      <label>メモ
        <input v-model="memo" class="memo-input" maxlength="400">
      </label>
      <button type="button" @click="save">保存</button>
      <button type="button" class="quiet" @click="remove">削除</button>
    </div>
  </article>
</template>

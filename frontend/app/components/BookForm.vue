<script setup>
var reading = useReading();
var draft = reading.draft;
var bookMessage = reading.bookMessage;
var labels = reading.labels;

function submit() {
  reading.addBook();
}
</script>

<template>
  <form class="panel" @submit.prevent="submit">
    <div class="row">
      <label>題名
        <input v-model="draft.title" class="title-input" maxlength="80" required>
      </label>
      <label>著者
        <input v-model="draft.author" class="author-input" maxlength="80" required>
      </label>
      <label>状態
        <select v-model="draft.status">
          <option v-for="(label, value) in labels" :key="value" :value="value">{{ label }}</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>メモ
        <input v-model="draft.memo" class="memo-input" maxlength="400">
      </label>
      <button type="submit">追加</button>
    </div>
    <p class="message">{{ bookMessage }}</p>
  </form>
</template>

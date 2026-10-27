<script setup>
var reading = useReading();
var books = reading.books;
</script>

<template>
  <p v-if="books.length === 0" class="empty">まだ本がありません。</p>
  <BookCard v-for="book in books" :key="book.id" :book="book" />
</template>

<script setup>
var reading = useReading();
var loggedIn = reading.loggedIn;
var userName = reading.userName;

onMounted(function () {
  reading.loadMe();
});
</script>

<template>
  <main>
    <h1>読書記録</h1>
    <p class="lead">読んだ本と、これから読む本を残します。</p>
    <FeatureGuide />
    <LoginPanel v-if="!loggedIn" />
    <section v-else>
      <div class="row">
        <span class="who">{{ userName }}</span>
        <button type="button" class="quiet" @click="reading.logout()">ログアウト</button>
      </div>
      <BookForm />
      <BookList />
    </section>
  </main>
</template>

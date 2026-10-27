<script setup>
var reading = useReading();
var name = reading.name;
var password = reading.password;
var loginMessage = reading.loginMessage;

function submit() {
  reading.auth("/api/login");
}

function register() {
  reading.auth("/api/register");
}
</script>

<template>
  <section class="panel">
    <form @submit.prevent="submit">
      <div class="row">
        <label>名前
          <input v-model="name" name="name" autocomplete="username" maxlength="32">
        </label>
        <label>パスワード
          <input v-model="password" name="password" type="password" autocomplete="current-password" maxlength="64">
        </label>
        <button type="submit">ログイン</button>
        <button type="button" class="quiet" @click="register">登録</button>
      </div>
      <p class="message">{{ loginMessage }}</p>
    </form>
  </section>
</template>

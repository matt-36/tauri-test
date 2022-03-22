<script>
    export let pgn;

    let clcolor = '#b9b9b9'
    let stcolor = '#b9b9b9'

    $: {
      if (pgn == 0) {
        clcolor = 'white';
        stcolor = '#b9b9b9';
      } else {
        clcolor = '#b9b9b9';
        stcolor = 'white'
      }
    }
</script>

<div class="container" data-tauri-drag-region>
  <div on:click={() => {pgn = 0}} style="color: {clcolor}">
    <span>
        Chatlist
    </span>
  </div>
  <div on:click={() => {pgn = 1}} style="color: {stcolor}">
    <span>
        Settings
    </span>
  </div>
</div>

<style lang="scss">
  .container {
    padding-bottom: 59px;
    display: flex;
    flex: 1 1 auto;
    flex-direction: row;
    width: 100%;
    height: 51px;
    background-color: var(--main-background);
    span {
        font-weight: 600;
    }
    div {
      display: flex;
      color: #b9b9b9;
      align-items: center;
      justify-content: center;
      width: 81px;
      height: 51px;
      transition: all ease-out .2s;
    }
    div:hover {
        cursor: pointer;
    }
  }
</style>

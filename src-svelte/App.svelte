<script>
    import { onMount } from 'svelte';

    import Navbar from './components/Navbar.svelte';
    import Chatlist from './pages/Chatlist.svelte';
    import Settings from './pages/Settings.svelte';

    const pages = [
        Chatlist,
        Settings
    ]
    let pgn = 0;
</script>

<Navbar bind:pgn/>
<div class="content">
    <svelte:component this={pages[pgn]} />
</div>

<style lang="scss">
    .content {
        padding: 8px;
        width: 100%;
        height: 100%;
        display: flex;
        & h1 {
            justify-self:center;
        }
    }

   
</style>
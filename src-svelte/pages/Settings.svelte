<script>
    import Slider from 'svelte-slider';

    let licence;
    window.__TAURI__.invoke('get_licence').then((ret) => licence = ret);
</script>

<div class="container">
    <div class="line">
        <div class="inner">
            Join delay
        </div>
        <Slider/>
    </div>
    <div class="line">
        <div class="inner">
            Message delay
        </div>
        <Slider/>
    </div>
    <div class="licence">
        {licence}
    </div>
</div>

<style lang="scss">
    .line {
        display: inline-flex;
        gap: 4em;
        align-items: center;

    }
    .inner {
        background-color: var(--light-background);

    }
</style>
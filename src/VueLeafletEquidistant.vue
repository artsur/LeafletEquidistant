<script>
  import './leaflet-equidistant';


  export default {
    name: "VueLeafletEquidistant",
    props: {
    },
    data(){
      return {

      }
    },
    mounted() {
      this.map = this.$parent.mapObject;
      const LE = L.leafletEquidistant();
      LE.addTo(this.$parent.mapObject);
    },
    beforeDestroy() {

    },
    watch: {

    },
    methods: {

    },
    render(){
      return null;
    }
  }
</script>

<style lang="scss">

</style>